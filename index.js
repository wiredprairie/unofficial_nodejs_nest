/*
 Copyright 2012 WiredPrairie.us

 Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
 documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
 rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 permit persons to whom the Software is furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all copies or substantial portions
 of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
 TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
 CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 DEALINGS IN THE SOFTWARE.

 FYI: Nest is a registered trademark of Nest Labs

 */

(function () {
    "use strict";

    var https = require('https'),
        queryString = require('querystring'),
        url = require('url'),
        util = require('util');


    var nestSession = {};
    var defaultNestUserAgent = 'Nest/3.0.15 (iOS) os=6.0 platform=iPad3,1';


    /* always call login first. :)  */
    var login = function (username, password, done) {
        nestPost({
                hostname:'home.nest.com',
                port:443,
                path:'/user/login',
                body:{'username':username, 'password':password},
                done:function (data) {
                    // internal and external
                    nestSession = data;
                    nestExports.session = data;
                    nestSession.urls.transport_url = url.parse(nestSession.urls.transport_url);

                    if (done) {
                        done(data);
                    }

                }
            }
        )
        ;
    };

    // Post data to Nest.
    // Settings object
    //   {
    //      hostname: string, usually set to the transport URL (default)
    //      port: defaults to 443, override here
    //      path : string
    //      body : string or object, if string, sent as is
    //              if object, converted to form-url encoded
    //              if body is string, content-type is auto set to
    //              application/json
    //              otherwise, set to urlencoded
    //              override this value with the headers param if
    //              needed
    //      headers: { headerName: Value }
    //      done: callback function
    //   }
    var nestPost = function (settings) {
        var allData = [];
        var post_data;
        var contentType;
        var hostname, port, path, body, headers, done;

        if (typeof settings === 'function') {
            // call the function and get the results, which
            // MUST be an object (so that it's processed below)
            settings = settings();
        }

        if (settings && typeof settings === 'object') {
            hostname = settings.hostname || nestSession.urls.transport_url.hostname;
            port = settings.port || nestSession.urls.transport_url.port;
            path = settings.path;
            body = settings.body || null;
            headers = settings.headers;
            done = settings.done;
        } else {
            throw new Error("Settings I need to function properly!");
        }

        // convert to a form url encoded body
        if (typeof body !== 'string') {
            post_data = queryString.stringify(body);
            contentType = 'application/x-www-form-urlencoded; charset=utf-8';
        } else {
            post_data = body;
            contentType = 'application/json';
        }
        var options = {
            host:hostname,
            port:port,
            path:path,
            method:'POST',
            headers:{
                'Content-Type':contentType,
                'User-Agent':nestExports.userAgent,
                'Content-Length':post_data.length
            }
        };

        if (headers) {
            options.headers = merge(options.headers, headers);
        }

        // if we're already authorized, add the necessary stuff....
        if (nestSession && nestSession.access_token) {
            options.headers = merge(options.headers, {
                'X-nl-user-id':nestSession.userid,
                'X-nl-protocol-version':'1',
                'Accept-Language':'en-us',
                'Authorization':'Basic ' + nestSession.access_token
            });
        }

        var request = https.request(options,
            function (response) {

                response.setEncoding('utf8');
                response.on('data', function (data) {
                    allData.push(data);
                });
                response.on('error', function() {
                    if (done) {
                        done(null, response.headers || {});
                    }
                });
                response.on('end', function () {
                    // convert all data
                    allData = allData.join('');
                    if (allData && typeof allData === 'string') {
                        allData = JSON.parse(allData);
                    }
                    if (done) {
                        done(allData, response.headers || {});
                    }
                });


            });
        request.write(post_data);
        request.end();

    };

    var nestGet = function (path, done) {
        var allData = [];

        var options = {
            host:nestSession.urls.transport_url.hostname,
            port:nestSession.urls.transport_url.port,
            path:path,
            method:'GET',
            headers:{
                'User-Agent':nestExports.userAgent,
                'X-nl-user-id':nestSession.userid,
                'X-nl-protocol-version':'1',
                'Accept-Language':'en-us',
                'Authorization':'Basic ' + nestSession.access_token
            }
        };
        var request = https.request(options,
            function (response) {

                response.setEncoding('utf8');
                response.on('data', function (data) {
                    allData.push(data);
                });
                response.on('end', function () {
                    // convert all data
                    allData = allData.join('');

                    if (allData && typeof allData === 'string' && allData.length > 0) {
                        allData = JSON.parse(allData);
                    } else {
                        allData = null;
                    }
                    if (done) {
                        done(allData);
                    }

                });
            });
        request.end();
    };

    var fetchCurrentStatus = function (done) {
        nestGet('/v2/mobile/' + nestSession.user, function (data) {
            if (!data) {
                console.log('unable to retrieve status');
                return;
            }

            nestExports.lastStatus = data;

            if (done) {
                done(data);
            }


        });
    };

    function pushKeys(keys, node, idnode) {
        idnode = idnode || node;         // might be the same thing ...

        var lastStatus = nestExports.lastStatus;
        var src;
        var version = 0;
        var timestamp = 0;
        // loop through a master list (that always has all keys)
        // but we might find data stored more specifically for a single key
        for (var id in lastStatus[idnode]) {
            src = version = timestamp = 0;
            if (lastStatus[node] && lastStatus[node].hasOwnProperty(id)) {
                src = node;
                version = lastStatus[node][id]['$version'];
                timestamp = lastStatus[src][id]['$timestamp'] || toUtc().getTime();
            } else if (lastStatus[idnode] && lastStatus[idnode].hasOwnProperty(id)) {
                src = idnode;
            }
            if (src) {
                keys.push({
                    key:node + '.' + id,
                    version:parseInt(version, 10), // subtle -- this MUST be a number, and not a quoted string with a number
                    timestamp:parseInt(timestamp, 10) // ditto
                });
            }
        }
    }

    function toUtc(now) {
        now = now || new Date();
        var now_utc = new Date(now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            now.getUTCHours(),
            now.getUTCMinutes(),
            now.getUTCSeconds(),
            now.getUTCMilliseconds()
        );
        return now_utc;
    }

    var subscribe = function (done, types) {
        if (!nestExports.lastStatus) {
            throw new Error("Must call fetchStatus to initialize.");
        }
        // always have something ...
        types = types || ['shared'];
        var body = {};
        // the only thing sent are the keys in a subscription
        var keys = body.keys = [];
        // here's what we did last time
        var lastStatus = nestExports.lastStatus;

        for (var i = 0, l = types.length; i < l; i++) {
            var key = types[i];
            switch (key) {
                case 'user':
                case 'shared':
                case 'track':
                case 'device':
                case 'structure':
                case 'user_alert_dialog':
                case 'user_settings':
                    pushKeys(keys, key);
                    break;
                case 'energy_latest':
                    pushKeys(keys, key, 'device');
                    break;
                default:
                    throw new Error("Unknown subscription type: " + key);
            }
        }

        keys.sort(function (a, b) {
            var d1 = a.key.split('.');
            var d2 = b.key.split('.');
            if (d1[1] < d2[1]) {
                return -1;
            }
            if (d1[1] > d2[1]) {
                return 1;
            }
            if (d1[0].substr(0, 6) === 'energy') {
                return 1;
            }
            return 0;
        });

        nestPost({
                path:'/v2/subscribe',
                body:JSON.stringify(body),
                headers:{
                    'X-nl-subscribe-timeout':60
                },
                done:function (data, headers) {
                    if (!data || !headers) {
                        done();
                    }
                    var device = headers['x-nl-skv-key'];
                    var timestamp = headers['x-nl-skv-timestamp'] || toUtc().getTime();
                    var version = headers['x-nl-skv-version'];

                    if (typeof device === 'string' && device.length > 0) {
                        device = device.split('.');
                        if (device.length > 1) {
                            // throw the version and timestamp on in a standard location for next time!
                            data['$version'] = version;
                            data['$timestamp'] = timestamp;
                            lastStatus[device[0]] = lastStatus[device[0]] || {};
                            lastStatus[device[0]][device[1]] = data;
                            if (done) {
                                done(device[1], data, device[0]);
                                return;
                            }
                        }
                    }
                    done();

                }
            }
        );

    };

    var setTemperature = function (thermostatID, tempC) {

        // likely passed in a F temp, so just convert it.
        if (tempC > 45) {
            tempC = fahrenheitToCelsius(tempC);
        }

        var body = {
            'target_change_pending':true,
            'target_temperature':tempC
        };

        body = JSON.stringify(body);
        var headers = {
            'X-nl-base-version':nestExports.lastStatus['shared'][thermostatID]['$version'],
            'Content-Type':'application/json'
        };

        nestPost({
            path:'/v2/put/shared.' + thermostatID,
            body:body,
            headers:headers,
            done:function (data) {
                console.log('Set temperature');
            }
        });
    };


    var fahrenheitToCelsius = function (f) {
        return (f - 32) * 5 / 9.0;
    };

    var celsiusToFahrenheit = function (c) {
        return Math.round(c * (9 / 5.0) + 32.0);
    };

    function merge(o1, o2) {
        o1 = o1 || {};
        if (!o2) {
            return o1;
        }
        for (var p in o2) {
            o1[p] = o2[p];
        }
        return o1;
    }

    // exported function list
    var nestExports = {
        'login':login,
        'setTemperature':setTemperature,
        'fetchStatus':fetchCurrentStatus,
        'subscribe':subscribe,
        'get':nestGet,
        'post':nestPost,
        'ftoc':fahrenheitToCelsius,
        'ctof':celsiusToFahrenheit
    };

    nestExports.userAgent = defaultNestUserAgent;

    var root = this; // might be window ...
    if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            exports = module.exports = nestExports;
        }
        exports.nest = nestExports;
    } else {
        root.nest = nestExports;
    }

})();