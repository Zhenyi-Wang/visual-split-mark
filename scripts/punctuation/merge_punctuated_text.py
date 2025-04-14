import json
import sys
import logging
from pathlib import Path

# 设置日志
log_dir = Path(__file__).parent
log_file = log_dir / 'merge_text.log'
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file, encoding='utf-8'),
        logging.StreamHandler()  # 同时输出到控制台
    ]
)
logger = logging.getLogger(__name__)

def merge_punctuated_text(original_file, punctuated_file, output_file):
    """
    将带有标点的文本合并回原始JSON结构中。
    
    Args:
        original_file: 原始JSON文件路径
        punctuated_file: 包含带标点文本的JSON文件路径
        output_file: 输出文件路径
    """
    try:
        logger.info('==' * 20)
        logger.info(f'Starting merge process')
        logger.info(f'Original file: {original_file}')
        logger.info(f'Punctuated file: {punctuated_file}')
        logger.info(f'Output file: {output_file}')

        # 读取原始JSON文件
        with open(original_file, 'r', encoding='utf-8') as f:
            original_data = json.load(f)

        # 读取带标点的JSON文件
        with open(punctuated_file, 'r', encoding='utf-8') as f:
            punctuated_data = json.load(f)

        # 创建ID到带标点文本的映射
        punctuation_map = {}
        for key, items in punctuated_data.items():
            for item in items:
                item_id = item.get('id')
                if item_id:
                    punctuation_map[item_id] = item.get('text_with_punctuation')

        # 更新原始数据
        merged_data = {}
        for key, items in original_data.items():
            merged_data[key] = []
            for item in items:
                item_id = item.get('id')
                if item_id and item_id in punctuation_map:
                    # 创建新的item字典，保持原始结构
                    new_item = item.copy()
                    new_item['text'] = punctuation_map[item_id]
                    merged_data[key].append(new_item)
                else:
                    logger.warning(f'No punctuated text found for id: {item_id}')
                    merged_data[key].append(item)

        # 保存合并后的数据
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(merged_data, f, indent=4, ensure_ascii=False)

        logger.info(f'Successfully merged data and saved to {output_file}')

    except Exception as e:
        logger.error(f'Error during merge process: {str(e)}')
        raise

if __name__ == "__main__":
    if len(sys.argv) != 4:
        logger.error('Usage: python merge_punctuated_text.py <original_file> <punctuated_file> <output_file>')
        sys.exit(1)

    original_file = sys.argv[1]
    punctuated_file = sys.argv[2]
    output_file = sys.argv[3]

    try:
        merge_punctuated_text(original_file, punctuated_file, output_file)
    except Exception as e:
        logger.error(f'Program failed: {str(e)}')
        sys.exit(1)
