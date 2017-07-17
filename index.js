// node --use_strict index.js

const moment = require('moment')
const nordpool = require('nordpool')
const prices = new nordpool.Prices()

require('dotenv').config()

"use strict"

const https = require("https")
const Encryption = require('./encryption.js')

require('dotenv').config()

let q, sessionid, vin

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

		// If session does not exist, then login first
		// if (!sessionid) { // TODO: Best practice?
		// 	api("UserLoginRequest") // TODO: WAIT!
		// } else {
			q = "custom_sessionid=" + sessionid + "&RegionCode=" + region_code + "&VIN=" + vin
		// }

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
				// console.log("Hours needed: " + json.BatteryStatusRecords.TimeRequiredToFull200.HourRequiredToFull)

				if(json.BatteryStatusRecords.PluginState == "NOT_CONNECTED") {
					console.log("Car not connected")
				} else {
					
					if(json.BatteryStatusRecords.BatteryStatus.BatteryChargingStatus == "NOT_CHARGING") {
						
						let hoursNeeded = json.BatteryStatusRecords.TimeRequiredToFull200.HourRequiredToFull

						// If there is need to charge, but not for a full hours
						if (hoursNeeded == 0) {
							hoursNeeded = 1
						}

						// Check to se if we need to add an extra hour, for shorter periods it's better to wait
						// Don't know if this can be the case, or if it always shows half hours
						if (json.BatteryStatusRecords.TimeRequiredToFull200.MinutesRequiredToFull > 40) {
							hoursNeeded += 1
						}

						console.log("Hours needed: " + hoursNeeded)

						maybeCharge(hoursNeeded);

					} else {
						console.log("Car is already chargeing, can't stop it")
					}

				}
			})
		}, 60*1000) // wait 60 seconds to get info from car (40 s needed when last tested)
	})
	
})

function maybeCharge(hoursNeeded) {

	let pricePerTime = new Array()

	let opts = {
		area: 'SE3',
		currency: 'EUR',
	}

	prices.hourly(opts, function (error, results) {
		if (error) console.err(error)

		for (let i=0; i<results.length; i++) {
			let date = results[i].date // moment object (see http://momentjs.com/)
			let price = results[i].value // float, EUR/MWh
		
			pricePerTime.push({
				date: date.format("YYYY-MM-DD HH:mm"),
				price: price.toFixed(2)
			})

			var today = moment().format("YYYY-MM-DD")

			opts = {
				area: 'SE3',
				currency: 'EUR',
				from: today,
			}
		}

		prices.hourly(opts, function (error, results) {
		if (error) console.err(error)

			for (let i=0; i<results.length; i++) {
				let date = results[i].date // moment object (see http://momentjs.com/)
				let price = results[i].value // float, EUR/MWh
			
				pricePerTime.push({
					date: date.format("YYYY-MM-DD HH:mm"),
					price: price.toFixed(2)
				})

			}

			// Only show future 
			const now = new Date(moment().minutes(0).seconds(0).milliseconds(0)); //new Date()

			// Tomorrow at 7
			var end  = new Date()
			end.setDate(end.getDate() + 1)
			end.setHours(7) // equals to leaving the car at 8am, but it might need 40 minutes more
			end.setMinutes(0)
			end.setMilliseconds(0)

			let time; 

			for (let key in pricePerTime) {
				time = new Date(pricePerTime[key].date);
				
				// Remove old data
				if (time < now) {
					delete pricePerTime[key]
				//	pricePerTime.splice(key,1)
				}

				// Exclude hours after when it needs to be done (7pm)
				if (time > end) {
					delete pricePerTime[key]
				//	pricePerTime.splice(key,1)
				}
			}

			pricePerTime.sort(function(a, b){
				return a.price-b.price
			})

			pricePerTime = pricePerTime.filter(function(n){ return n != undefined });

			console.log(pricePerTime)
			console.log(pricePerTime.length)

			if (hoursNeeded > pricePerTime.length) {
				console.log("Not enough hours tonight!")
				hoursNeeded = pricePerTime.length
			}

			let theHours = new Array()

			for (let i = 0; i < hoursNeeded; i++) {
				time = new Date(pricePerTime[i].date);

				if (time.getTime() == now.getTime()) {
					//charge car if connected and not charging
					console.log("Hours needed: ", hoursNeeded)
					console.log("CHARGE CAR NOW!")

					api("BatteryRemoteChargingRequest", function() {
						console.log("Charge car command sent")
					})

				}

				theHours.push({
					date: pricePerTime[i].date
				})
			}

			theHours.sort(function(a, b){
				var dateA=new Date(a.date), dateB=new Date(b.date)
    			return dateA-dateB //sort by date ascending
			})
			console.log(theHours)

		})

	})

}