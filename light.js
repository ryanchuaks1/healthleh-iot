const wpi = require('wiring-pi');
const Client = require('azure-iot-device').Client;
const Protocol = require('azure-iot-device-mqtt').Mqtt;
const BME280 = require('bme280-sensor');

const BME280_OPTION = {
  i2cBusNo: 1, // defaults to 1
  i2cAddress: BME280.BME280_DEFAULT_I2C_ADDRESS() // defaults to 0x77
};

const connectionString = light; // REPLACE WITH ONE FROM ENV FILE
const LEDPin = 4;

var client;
var sensor;
var blinkLEDTimeout = null;

// Direct method callback for "start"
function onStart(request, response) {
  console.log('Received start method with payload: ' + JSON.stringify(request.payload));
  
  if (request.payload && request.payload.action) {
    switch (request.payload.action) {
      case 'flash':
        blinkLED(); // Simple blink
        break;
      case 'blink':
        blinkLEDMultipleTimes(); // Multiple blinks
        break;
      default:
        console.log("Unknown action: " + request.payload.action);
    }
  } else {
    // Default behavior if no action provided
    blinkLED();
  }
  
  response.send(200, 'Method processed successfully', function (err) {
    if (err) {
      console.error('[IoT hub Client] Error sending method response: ' + err.message);
    }
  });
}

// Direct method callback for "stop"
function onStop(request, response) {
  console.log('Received stop method with payload: ' + JSON.stringify(request.payload));
  // Add any logic to stop ongoing actions if necessary
  response.send(200, 'Stop method processed successfully', function (err) {
    if (err) {
      console.error('[IoT hub Client] Error sending method response: ' + err.message);
    }
  });
}

// Blink LED multiple times function
function blinkLEDMultipleTimes() {
  const blinkCount = 3;
  const delay = 500; // milliseconds

  function blink(count) {
    if (count === 0) return;
    wpi.digitalWrite(LEDPin, 1);
    setTimeout(() => {
      wpi.digitalWrite(LEDPin, 0);
      setTimeout(() => {
        blink(count - 1);
      }, delay);
    }, delay);
  }
  blink(blinkCount);
}

// Simple blink LED function
function blinkLED() {
  if (blinkLEDTimeout) {
    clearTimeout(blinkLEDTimeout);
  }
  wpi.digitalWrite(LEDPin, 1);
  blinkLEDTimeout = setTimeout(function () {
    wpi.digitalWrite(LEDPin, 0);
  }, 500);
}

// Set up wiring for LED
wpi.setup('wpi');
wpi.pinMode(LEDPin, wpi.OUTPUT);

// Initialize sensor (if you need it for something else)
sensor = new BME280(BME280_OPTION);
sensor.init()
  .then(function () {
    console.log("Sensor initialized");
  })
  .catch(function (err) {
    console.error("Sensor initialization failed:", err.message || err);
  });

// Create IoT Hub client and open connection
client = Client.fromConnectionString(connectionString, Protocol);
client.open(function (err) {
  if (err) {
    console.error('[IoT hub Client] Connect error: ' + err.message);
    return;
  }

  // Set direct method callbacks
  client.onDeviceMethod('start', onStart);
  client.onDeviceMethod('stop', onStop);
  
  console.log("Device is now listening for direct method calls.");
});
