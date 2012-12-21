Unofficial Nest API on Node
===========================

This is a very unofficial demonstration of the API used by Nest Thermostats to communicate back to the Nest Lab web
servers.

For more information about the API and communication check [here](http://www.wiredprairie.us/blog/index.php/archives/1754).

The file, app.js included demonstrates one way to use the API.

To use it as is:

* Install Node from http://nodejs.org
* Install the unofficial Nest Thermostat API:

    npm install unofficial-nest-api
* Run:
    
    node app.js 'NESTUSERNAME' 'NESTPASSWORD'

To set the temperature, you'll need to login, and fetch the status once before calling the setTemperature function:

    nest.login(username, password, function (data) {
        if (!data) {
            console.log('Login failed.');
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

Also, note that the subscribe function may not return results frequently. It's based on the data coming from your
thermostats, which may not change frequently. There's a default 60 second timeout. The callback is always called,
which then gives your code an opportunity to call subscribe again.
