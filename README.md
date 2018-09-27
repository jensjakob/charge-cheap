Charge your Nissan EV (Leaf and e-NV200) during cheapest hours according to Nord Pool.

Function will run during evening and night, each hour between 17pm and 7am.

# Installation
```
git clone https://github.com/jensjakob/charge-cheap.git
cd charge-cheap
npm install
printf '%s\n' 'USERNAME=' 'PASSWORD=' >.env
nano .env
```
Enter your Nissan username and password to the .env-file
Exit using ctrl+x

## Dependencies
* nodejs (including npm)
```
curl -sL https://deb.nodesource.com/setup_9.x | sudo -E bash -
sudo apt-get install nodejs
```
Installing Node.js with package manager:
https://nodejs.org/en/download/package-manager

## Run
1. Open an instance that will not be terminated when closing connection
```
screen -Rd
```
2. Run
```
node charge-cheap/index.js
```
3. Leave screen using "ctrl+a" then "ctrl+d" or close connection.

* Check status using `screen -Rd`
* Close Charge Cheap using "ctrl+c"

## Update

It will check for new versions when you start it.
Update using ``git pull && npm update``

## Best practice
Set your car to automatically charge to be done in the morning at 8 am. This is a great way to make sure that your car is charged even if you experience problems with the code, the computer or the connection to the car.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
