Unofficial Nest API on Node
===========================

This is a **very unofficial** demonstration of the API used by Nest Thermostats.

For more information about the unofficial API and communication check [here](http://www.wiredprairie.us/blog/index.php/archives/1754).

The file, app.js included demonstrates one way to use the API.

To use it as is:

* Install Node from http://nodejs.org
* Install the unofficial Nest Thermostat API:

    `npm install unofficial-nest-api`
    
* Run:
    
    `node app.js 'NESTUSERNAME' 'NESTPASSWORD'`

To set the temperature, you'll need to login, and fetch the status once before calling the setTemperature function:

    nest.login(username, password, function (err, data) {
        if (err) {
            console.log(err.message);
            process.exit(1);
            return;
        }
        nest.fetchStatus(function (data) {
            for (var deviceId in data.device) {
                if (data.device.hasOwnProperty(deviceId)) {
                    var device = data.shared[deviceId];
                    // here's the device and ID
                    nest.setTemperature(deviceId, nest.ftoc(70));
                }
            }
        });
    });

The example above sets the temperature of every thermostat in current structure to 70F.

Also, note that the subscribe function may not return results frequently. It's based on the data coming from your
thermostats, which may not change frequently. There's a default 60 second timeout. The callback is always called,
which then gives your code an opportunity to call subscribe again.

There are a handful of provided functions:

* `setTemperature(thermostatID, temperature)`
* `setTemperature(temperature)` => defaults to first device (only use this if you have one thermostat)
* `setAway(structureID [optional, default = first structure], away [optional, default=true])`
* `setHome(structureID [optional, default = first structure])`
* `setFanModeAuto(deviceID [optional, default = first device])`
* `setFanModeOn(deviceID [optional, default = first device])`
* `setTargetTemperatureType(deviceID [optional, default = first device], temperatureType ['cool','heat','range'])`
* `ctof` => Celsius to Fahrenheit
* `ftoc` => Fahrenheit to Celsius
* `getStructureId` => returns the first structure Id found
* `getStructureIds` => returns all structure Ids, as an array
* `getDeviceIds` => returns all device Ids, as an array
