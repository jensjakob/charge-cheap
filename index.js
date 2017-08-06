const https = require("https")
const Encryption = require('./encryption.js')

const moment = require('moment')
const nordpool = require('nordpool')
const prices = new nordpool.Prices()

require('dotenv').config()

var checkUpdate = require('check-update-github');
var pkg = require('./package.json');

var cron = require('node-cron');

checkUpdate({
	name: pkg.name,
	currentVersion: pkg.version,
	user: 'jensjakob',
	branch: 'master'
	}, function(err, latestVersion, defaultMessage){
	if(!err){
		console.log("")
		console.log(defaultMessage);
		console.log("")
	}
});

if (typeof process.env.USERNAME === "undefined") {
	console.log("=== ERROR! ===================")
	console.error("Username/password is missing.")
	console.log("================================")
	console.log("")
	console.log("Create an .env file including:")
	console.log("USERNAME=")
	console.log("PASSWORD=")
	console.log("")
}

let q, sessionid, vin

const today = moment().format("YYYY-MM-DD")
const tomorrow = moment().add(1,"d").format("YYYY-MM-DD")
const todaytime = Number(moment().format("HHmm"))

console.log("Function will run during evening and night, each hour between 17pm and 7am")
cron.schedule('0 0-7,17-23 * * *', () => {
	run();
})

console.log("Run once in 3 seconds...")
setTimeout(() => {
	run();
}, 3*1000)

function run() {

	//if in the morning (code won't run during day)
	if (todaytime < 1700) {
		
		getPrices(today + " 07:00", (morningPrices) => {

			console.log("Prices for this morning:")
			console.log(morningPrices)

			console.log("Remove old prices")
			morningPrices = removeUntilNow(morningPrices)
			console.log(morningPrices)

			getHoursNeeded((hoursNeeded) => {
				console.log("Hours needed: " + hoursNeeded)

				if (hoursNeeded > morningPrices.length) {
					console.log("Not enough hours for a full charge this morning, start asap")
					chargeNow()
				} else {
					if (timeIsNow(morningPrices, hoursNeeded)) {
						console.log("Now is a good time to start chargeing")
						chargeNow()
					}
				}
			})
		})

	} else {

		getPrices(tomorrow + " 07:00", (allPrices) => {

			console.log("Tomorrows prices until 7am:")
			console.log(allPrices)

			getPrices(today + " 23:00", (todayPrices) => {
				console.log(todayPrices)
				console.log("Adding todays prices, " + today)
				allPrices.push.apply(allPrices, todayPrices)

				console.log("All received prices:")
				console.log(allPrices)

				console.log("Remove old prices:")
				allPrices = removeUntilNow(allPrices)
				console.log(allPrices)

				console.log("Finding out how many hours of chargeing is needed")

				getHoursNeeded((hoursNeeded) => {
					if (hoursNeeded > allPrices.length) {
						console.log("Not enough hours for a full charge tonight")
						chargeNow()
					} else {
						if (timeIsNow(allPrices, hoursNeeded)) {
							console.log("Now is a good time to start chargeing")
							chargeNow()
						}
					}
				}) // getHoursNeeded

			}) // getPrices

		}) // getPrices
	}

}


function getPrices(to, _callback) {
	let arr = new Array()

	options = {
		area: 'SE3',
		currency: 'EUR',
		to: to
	}
	console.log("Get prices for " + to )

	prices.hourly(options, (error, results) => {
		if (error) console.error(error)

		for (let i=0; i<results.length; i++) {
			arr.push({
				date: results[i].date.format("YYYY-MM-DD HH:mm"),
				price: results[i].value.toFixed(2)
			})
		}

		_callback(arr)
	})
}

function removeUntilNow(arr) {
	const now = moment().format("YYYYMMDDHH00")

	for (let key in arr) {

		time = moment(arr[key].date).format("YYYYMMDDHH00")

		if (time < now) {
			delete arr[key]
		}
	}

	return cleanArray(arr)
}

function cleanArray(arr) {
	console.log("Cleaning all deleted prices")
	return arr.filter(function(n){ return n != undefined });
}

function getHoursNeeded(_callback) {

	api("UserLoginRequest", (json) => {
		if (json.VehicleInfoList) {
			sessionid = encodeURIComponent(json.VehicleInfoList.vehicleInfo[0].custom_sessionid)
			vin = encodeURIComponent(json.VehicleInfoList.vehicleInfo[0].vin)
		} else  {
			sessionid = encodeURIComponent(json.vehicleInfo[0].custom_sessionid)
			vin = encodeURIComponent(json.vehicleInfo[0].vin)
		}
		api("BatteryStatusCheckRequest", () => {
			console.log("Receiving data from car... (wait one minute)")
			setTimeout(() => {
				api("BatteryStatusRecordsRequest", (json) => {
					console.log(json)

					try {

						let hoursNeeded = json.BatteryStatusRecords.TimeRequiredToFull200.HourRequiredToFull

						// If there is need to charge, but not for a full hours
						if (hoursNeeded == 0) {
							hoursNeeded = 1
						}

						// We just check for full hours.

						console.log("Hours needed: " + hoursNeeded)

						_callback(hoursNeeded)

					} catch(e) {

						console.log("Might not need charging")
						_callback(0)

					}

				})
			}, 60*1000) // wait 60 seconds to get info from car (40 s needed when last tested)
		})

	})
}

function api(action, _callback) {
	q = ""
	const region_code = "NE"

	// If action is login, then we need to set username and password
	if (action == "UserLoginRequest") {

		console.log("do login")

		const initial_app_strings = "geORNtsZe5I4lRGjG9GZiA"
		const username = process.env.USERNAME // Your NissanConnect username or email address.
		const password = encrypt(process.env.PASSWORD) // Your NissanConnect account password.

		function encrypt(password) {
			var e = new Encryption()
			return e.encrypt(password, "uyI5Dj9g8VCOFDnBRUbr3g")
		}

		q = "UserId=" + username + "&initial_app_strings=" + initial_app_strings + "&RegionCode=" + region_code + "&Password=" + password

	} else {

		q = "custom_sessionid=" + sessionid + "&RegionCode=" + region_code + "&VIN=" + vin

	} // if login

	let options = {
		hostname: "gdcportalgw.its-mo.com",
		port: 443,
		path: "/gworchest_160803EC/gdc/" + action + ".php",
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			"Content-Length": Buffer.byteLength(q),
		}
	}

	let req = https.request(options, (res) => {
		//console.log(`${options.hostname}${options.path}?${q}`)
		//console.log(`${res.statusCode}: ${res.statusMessage}`)
		console.log(action)

		let respData = ""
		res.on('data', (d) => {
			//process.stdout.write(d)
			respData += d.toString()
		})

		res.on("end", () => {
			let json = respData && respData.length ? JSON.parse(respData) : null
			//console.log("response: " + respData)
			_callback(json)

		})

	})
	req.write(q)
	req.end()

} // function api()


function timeIsNow(allPrices, hoursNeeded) {

	allPrices.sort((a, b) => {
		return a.price-b.price
	})
	console.log("Best price first:")
	console.log(allPrices)

	const now = moment().format("HH00");

	for (let i = 0; i < hoursNeeded; i++) {
		time = moment(allPrices[i].date).format("HHmm");

		console.log("Charge at " + time + ", now is " + now)
		if (time == now) {

			return true
			break

		}
	}
}

function chargeNow() {

	console.log("Is car ready to be charged?")

	if (isCarReady()) {
		console.log("Charge car now")
		api("BatteryRemoteChargingRequest", () => {})
	}
}

function isCarReady() {

	let carReady = true

	// You need to login and wait for fresh data first, then...
	api("BatteryStatusRecordsRequest", (json) => {

		console.log(json)

		// Check if already charging
		try {
			if(json.BatteryStatusRecords.BatteryStatus.BatteryChargingStatus != "NOT_CHARGING") {
				console.log("Car is already chargeing, can't stop it")
				carReady = false
			}
		} catch(e) {
			console.log("Don't know if car is charging")
			carReady = false
		}

		// Check if not connected
		try {
			if(json.BatteryStatusRecords.PluginState == "NOT_CONNECTED") {
				console.log("Car not connected")
				carReady = false
			}
		} catch(e) {
			console.log("Don't know if car is connected")
			carReady = false
		}

		return carReady;

	})

}