Charge your Nissan EV (Leaf and e-NV200) during cheapest hours according to Nord Pool.

Function will run during evening and night, each hour between 17pm and 7am.

# Installation
```
git clone https://github.com/jensjakob/charge-cheap.git
cd charge-cheap
npm install
printf '%s\n' 'USERNAME=' 'PASSWORD=' >.env
node index.js
```
Don't forget adding your username and password to the .env-file

Exit using ctrl+c

## Dependencies
* nodejs (including npm)
```
curl -sL https://deb.nodesource.com/setup_9.x | sudo -E bash -
sudo apt-get install nodejs
```
Installing Node.js with package manager:
https://nodejs.org/en/download/package-manager

## Update

It will check for new versions, update using ``git pull && npm update``

## Best practice
Set your car to automatically charge to be done in the morning at 8 am. This is a great way to make sure that your car is charged even if you experience problems with the code, the computer or the connection to the car.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
