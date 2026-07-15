# Media Players

## Mediaflow Player
Note this one is the main project now
The read me for the vite thing is in the Mediaflow Player folder and named README.md
Description: A simple music player that can play music from youtube locally. This app is for web and desktop. It uses vite as the framework, and it uses yt-dlp to get the audio for youtube, and localStorage for local storage.

## Aura Player
Still a WIP but will get less updates than mediaflow, please use electron with mediaflow if you want all rounder suport.
The read me for the flutter thing is in the Aura Player folder and named README.md
Description: A simple music player that can play music from youtube locally. This app suports ever platform and that is the main reason flutter was chosen. It uses Flutter as the framework.

## Comparison
| Feature | Aura Player | Mediaflow Player |
| --- | --- | --- |
| Framework | Flutter | Vite |
| Platform | Android, iOS, Web, Desktop | Electron, Desktop |
| Storage | NA | localStorage |
| API | NA | yt-dlp |
| Description | A simple music player that can play music from locally sorced files. This app suports ever platform and that is the main reason flutter was chosen. It uses Flutter as the framework. | A simple music player that can play music from youtube locally. This app is for web and desktop. It uses vite as the framework, pytubefix to get the audio from youtube, and localStorage for local storage. |
| Notes | The app is very basic and only has a few features. It is a work in progress. | The app is very basic and only has a few features. It is also a work in progress. |

##
Due to how this is structured you will have to navigate to the brach of the repository to use the disired player. For example, if you want to use Mediaflow Player, you will have to navigate to the Mediaflow player branch, and continue from there, and same for Aura Player. The main branch is used as a root file storage hub so the different players don't interfere with each other's things. In the future I plan on possibly separating the projects into one main project with all the features of each.
