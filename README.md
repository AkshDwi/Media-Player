# Mediaflow Player

Description: A simple music player that can play music from youtube locally. This app is for web and desktop. It uses vite as the framework, it uses yt-dlp to get the audio from youtube, and localStorage for local storage.

## How to use
This one is a multi step process:

```bash
#step 1 terminal one
cd mediaflow_player\server
pip install -r requirements.txt
python app.py
#step 2 terminal two
cd mediaflow_player
npm install
npm run dev
#step 3 terminal three
cd mediaflow_player\server
npm install
npm start
```
Note to use the file conversion feature install ffmpeg and add it to your path.
```bash
#For windows
winget install ffmpeg

#For debian based linux
sudo apt install ffmpeg

#For red hat based linux
sudo dnf install ffmpeg

#For arch based linux
sudo pacman -S ffmpeg

#For macos
brew install ffmpeg
```

## How to use as a electron app
For windows just downlode the released app
```bash
#If the release dose not work for some reason build from source by running this
#If the compiled app dose not work just set a local command for "npm run electron:dev" in your apps floder in the desegnated OS.

#For windows
cd mediaflow_player\server
npm install
pip install -r requirements.txt
cd ..
npm install
npm audit fix --force
npm run electron:build:win

#For linux
cd mediaflow_player/server
npm install
pip install -r requirements.txt
cd ..
npm install
npm audit fix --force
npm run electron:build:linux

#For macos
cd mediaflow_player/server
npm install
pip install -r requirements.txt
cd ..
npm install
npm audit fix --force
npm run electron:build:mac
```
### Note
This one not that simple, but it works. And it's compleatly free unlike apify.
A mobile verson might come out but it's not easy to do.

If none of the methods for how to use or how to use as a electron app works file a issue on github. I will try my best to fix it.