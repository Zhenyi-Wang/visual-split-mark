import json
import sys
import time
import logging
from pathlib import Path
from openai import OpenAI
from config import OPENAI_API_KEY, OPENAI_BASE_URL

# 设置日志
log_dir = Path(__file__).parent
log_file = log_dir / 'extract_text.log'
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file, encoding='utf-8'),
        logging.StreamHandler()  # 同时输出到控制台
    ]
)
logger = logging.getLogger(__name__)

def add_punctuation_with_llm(texts, batch_size=25):
    client = OpenAI(
        api_key=OPENAI_API_KEY,
        base_url=OPENAI_BASE_URL
        )
    punctuated_texts = []
    logger.info(f'Processing {len(texts)} texts with total {sum(len(text) for text in texts)} characters')
    
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        max_retries = 10
        success = False
        
        for retry in range(max_retries):
            try:
                prompt = f'''
                # 任务说明
                - 你是一个语言处理专家，任务是为给定的文本片段添加或矫正标点符号。
                - 严格保持输入文本的数量，不要合并或拆分文本。

                # 情景说明
                - 这些文本片段是用于whisper模型的训练数据，文本已经校对过，只需要添加或矫正标点符号。

                # 输入格式
                - 为了方便你了解上下文，我是以json数组的形式，一次给你多个文本片段。
                - 有些文本片段可能已经有标点符号，有些没有。
                例如：["让他掌权", "为什么呢?", "耶稣是谁呢", "耶稣究竟做了什么?"]

                # 输出格式和要求
                - 必须返回与输入数组长度相同的数组，每个位置对应输入数组的相同位置。
                - 必须以完整的json数组格式返回。
                - 请确保每个文本片段都有标点符号。
                - 请确保使用中文标点符号，并符合中文语言习惯。
                - 请确保片段最后的标点符合上下文，而不是一昧地用句号结尾。
                - 请不要改变文本内容，只添加标点符号。
                - 不要合并或拆分文本。

                # 正确示例
                输入：["让他掌权", "为什么呢?", "耶稣是谁呢", "耶稣究竟做了什么?"]
                输出：["让他掌权。", "为什么呢？", "耶稣是谁呢？", "耶稣究竟做了什么？"]

                # 错误示例
                输入：["让他掌权", "为什么呢?"]
                错误输出：["让他掌权，为什么呢？"]  # 错误：合并了文本
                正确输出：["让他掌权？", "为什么呢？"]  # 正确：保持独立
                '''
                
                user_prompt = json.dumps(batch, ensure_ascii=False)
                
                logger.info(f'Processing batch {i//batch_size + 1} of {len(texts)//batch_size + 1}, attempt {retry + 1} of {max_retries}')
                logger.debug(f'Input texts: {user_prompt}')
                
                response = client.chat.completions.create(
                    model="deepseek/deepseek-chat:free",
                    messages=[
                        {"role": "system", "content": prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.3  # 降低temperature以获得更稳定的输出
                )
                
                content = response.choices[0].message.content.strip()
                logger.debug(f'Raw response: {content}')
                
                # 提取JSON数组部分
                start_idx = content.find('[')
                end_idx = content.rfind(']')
                if start_idx == -1 or end_idx == -1:
                    raise ValueError("Response does not contain valid JSON array")
                
                json_str = content[start_idx:end_idx + 1]
                result = json.loads(json_str)
                
                # 验证结果长度
                if len(result) != len(batch):
                    raise ValueError(f"Output length ({len(result)}) does not match input length ({len(batch)})")
                
                punctuated_texts.extend(result)
                success = True
                logger.info(f'Successfully processed batch {i//batch_size + 1} of {math.ceil(len(data) / batch_size)}')
                break
                
            except Exception as e:
                logger.error(f'Error on attempt {retry + 1}: {str(e)}')
                logger.error(f'Batch content: {json.dumps(batch, ensure_ascii=False, indent=2)}')
                if isinstance(e, ValueError) and content:
                    logger.error(f'Last response content: {content}')
                if retry == max_retries - 1:  # 最后一次重试失败
                    logger.warning(f'Failed after {max_retries} attempts for batch {i//batch_size + 1}. Using original texts.')
                    # 使用原始文本作为后备方案
                    punctuated_texts.extend([text + '。' for text in batch])
                    # 记录失败的文本
                    logger.warning('Failed texts:')
                    for idx, text in enumerate(batch):
                        logger.warning(f'  {idx + 1}. {text}')
                time.sleep(2)  # 添加延迟避免频繁请求
        
        if not success:
            logger.warning(f'Batch {i//batch_size + 1} failed all retries')
    
    return punctuated_texts

def extract_id_and_text(input_file, output_file):
    try:
        logger.info('==' * 20)
        logger.info(f'Starting extraction from {input_file} to {output_file}')
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        extracted_data = {}
        for key, items in data.items():
            extracted_data[key] = []
            texts = [item.get("text") for item in items]
            punctuated_texts = add_punctuation_with_llm(texts)
            for item, text in zip(items, punctuated_texts):
                extracted_data[key].append({
                    "id": item.get("id"),
                    "text": item.get("text"),
                    "text_with_punctuation": text
                })
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(extracted_data, f, indent=4, ensure_ascii=False)
        
        logger.info(f'Data successfully extracted and saved to {output_file}')
    
    except Exception as e:
        logger.error(f'Error during extraction: {str(e)}')
        raise

if __name__ == "__main__":
    if len(sys.argv) != 3:
        logger.error('Usage: python script.py <input_file> <output_file>')
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    try:
        extract_id_and_text(input_file, output_file)
    except Exception as e:
        logger.error(f'Program failed: {str(e)}')
        sys.exit(1)