# Visual Split Mark

English | [简体中文](README.md)

An audio annotation tool specifically designed for creating fine-tuning datasets for Whisper models. Through an intuitive visual interface, users can quickly and accurately create high-quality speech recognition training data.

## Introduction

This project is primarily used to generate fine-tuning datasets for the [Whisper-Finetune](https://github.com/yeyupiaoling/Whisper-Finetune) project. To improve annotation efficiency, the project integrates Whisper transcription functionality, allowing for initial transcription via Whisper followed by manual correction. If you need a simple Whisper API service, you can refer to the [whisper-api](https://github.com/Zhenyi-Wang/whisper-api) project.

## Main Features

### Audio Visualization & Annotation
- Waveform visualization display
- Region selection and time adjustment
- Text annotation and editing
- Whisper API transcription support
- Auto-save annotation data

### Playback Control
- Space key shortcut for play/pause
- Adjustable playback speed (0.5x - 5x)
- Click annotation region for quick positioning
- Waveform zoom control (pixels/second adjustable)

### Data Export
- Compatible with Whisper-Finetune format
- JSONL format data file
- Automatic audio segment splitting
- Real-time export progress display

## Quick Start

### Installation
```bash
yarn install
```

### Running
```bash
# Development mode
yarn dev

# Build for deployment
yarn build
```

### Configuring Whisper API
Configure the Whisper API URL in project settings to enable text recognition. [whisper-api](https://github.com/Zhenyi-Wang/whisper-api) is recommended as the backend service.

## Usage Guide

### Annotation Process
1. Create project and upload audio file
2. Optional: Use Whisper API for initial transcription
3. Select audio segments through waveform interface
4. Add or edit text annotations
5. Export dataset

### Annotation Operations
- **Region Selection**: Drag mouse in waveform area
- **Time Adjustment**: Drag region boundaries
- **Text Editing**: Click edit button in top-right corner of annotation region
- **Delete Annotation**: Click delete button in top-right corner of annotation region

### Shortcuts
- Space key: Play/Pause
- More shortcuts in development...

## Data Format

### Storage Structure
- Project data: `storage/data/`
- Export data: `storage/exports/YYYYMMDD_HHmmss_ProjectName_AudioFileName/`

### Export Format
```
Export Directory/
├── dataset/                # Audio segments directory
│   ├── uuid1.wav          # Audio segment file
│   ├── uuid2.wav
│   └── ...
└── dataset.json           # Dataset description file (JSONL format)
```

### dataset.json Format
```jsonl
{"audio":{"path":"dataset/uuid1.wav"},"sentence":"annotation text","language":"Chinese","duration":2.34}
```

Field descriptions:
- `audio.path`: Audio file relative path
- `sentence`: Annotation text content
- `language`: Text language (fixed as "Chinese")
- `duration`: Audio segment duration (seconds, 2 decimal places)

## Development Plans

- [ ] Add more keyboard shortcuts
- [ ] Optimize audio processing performance
- [ ] Add batch operation functionality
- [ ] Support more audio formats

## Contributing

The project has completed its basic functionality and welcomes testing and improvement suggestions. We will continue to optimize based on actual usage. If you have any ideas or suggestions, feel free to raise an Issue or submit a Pull Request. 