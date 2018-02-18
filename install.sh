#!/bin/bash

echo "Installing avr-pizza-service..."
mkdir -p  ~/.avrpizza
mkdir -p bin/builder
cd bin/builder

OPS=`uname`
echo "$OPS" 

echo "Installing Arduino IDE"

if [ "$OPS" = "Linux" ]; then
  wget -q https://downloads.arduino.cc/arduino-1.8.5-linux64.tar.xz
  tar -xpf arduino-1.8.5-linux64.tar.xz
  mv arduino-1.8.5 arduino
  chmod +x arduino/hardware/tools/avr/bin/*
  rm -rf arduino/references arduino/examples arduino/lib arduino/java
  rm -rf arduino-1.8.5-linux64.tar.xz

elif [ "$OPS" = "Darwin" ]; then
  mkdir arduino
  cd arduino
  wget https://downloads.arduino.cc/arduino-1.8.5-macosx.zip
  unzip arduino-1.8.5-macosx
  cp -R Arduino.app/Contents/Java/* ./
  rm -rf arduino-1.8.5-macosx.zip Arduino.app
else
  echo "Sorry, at the moment avrpizza-service only runs on Unix systems :("
fi

echo "Arduino IDE installed."
echo "All done."

