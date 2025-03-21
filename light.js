const wpi = require('wiring-pi');
const Client = require('azure-iot-device').Client;
const Message = require('azure-iot-device').Message;
const Protocol = require('azure-iot-device-mqtt').Mqtt;
const BME280 = require('bme280-sensor');

const BME280_OPTION = {
  i2cBusNo: 1, // defaults to 1
  i2cAddress: BME280.BME280_DEFAULT_I2C_ADDRESS() // defaults to 0x77
};

const connectionString = light; // REPLACE WITH ONE FROM ENV FILE
const LEDPin = 4;

var sendingMessage = false;
var messageId = 0;
var client, sensor;
var blinkLEDTimeout = null;

function getMessage(cb) {
  messageId++;
  sensor.readSensorData()
    .then(function (data) {
      cb(JSON.stringify({
        messageId: messageId,
        deviceId: 'Raspberry Pi Web Client',
        temperature: data.temperature_C,
        humidity: data.humidity
      }), data.temperature_C > 30);
    })
    .catch(function (err) {
      console.error('Failed to read out sensor data: ' + err);
    });
}

function sendMessage() {
  if (!sendingMessage) { return; }

  getMessage(function (content) {
    var message = new Message(content);
    message.properties.add("user", "81228470");
    message.properties.add("location", "1.4011010760813023, 103.90204792348037");
    message.properties.add("info", "Hello from pi!");
    console.log('Sending message: ' + content);
    client.sendEvent(message, function (err) {
      if (err) {
        console.error('Failed to send message to Azure IoT Hub');
      } else {
        blinkLED();
        console.log('Message sent to Azure IoT Hub');
      }
    });
  });
}

function onStart(request, response) {
  console.log('Try to invoke method start(' + request.payload + ')');
  sendingMessage = true;

  response.send(200, 'Successully start sending message to cloud', function (err) {
    if (err) {
      console.error('[IoT hub Client] Failed sending a method response:\n' + err.message);
    }
  });
}

function onStop(request, response) {
  console.log('Try to invoke method stop(' + request.payload + ')');
  sendingMessage = false;

  response.send(200, 'Successully stop sending message to cloud', function (err) {
    if (err) {
      console.error('[IoT hub Client] Failed sending a method response:\n' + err.message);
    }
  });
}

function receiveMessageCallback(msg) {
  var messageContent = msg.getData().toString('utf-8');
  console.log('Received message: ' + messageContent);

  try {
    // Attempt to parse the message as JSON
    var commandData = JSON.parse(messageContent);
    if (commandData && commandData.action) {
      switch (commandData.action) {
        case 'flash':
          blinkLED(); // Default blink (500 ms on)
          break;
        case 'blink':
          blinkLEDMultipleTimes(); // A custom function to blink multiple times
          break;
        default:
          console.log("Unknown action: " + commandData.action);
      }
    } else {
      // If no action is provided, fall back to default behavior
      blinkLED();
    }
  } catch (e) {
    console.log("Message payload is not valid JSON. Performing default blink.");
    blinkLED();
  }

  // Complete the message so it's removed from the queue
  client.complete(msg, function () {
    console.log('Message processed.');
  });
}

// Example function: Blink LED multiple times
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

function blinkLED() {
  // Light up LED for 500 ms
  if(blinkLEDTimeout) {
       clearTimeout(blinkLEDTimeout);
   }
  wpi.digitalWrite(LEDPin, 1);
  blinkLEDTimeout = setTimeout(function () {
    wpi.digitalWrite(LEDPin, 0);
  }, 500);
}

// set up wiring
wpi.setup('wpi');
wpi.pinMode(LEDPin, wpi.OUTPUT);
sensor = new BME280(BME280_OPTION);
sensor.init()
  .then(function () {
    sendingMessage = true;
  })
  .catch(function (err) {
    console.error(err.message || err);
  });

// create a client
client = Client.fromConnectionString(connectionString, Protocol);

client.open(function (err) {
  if (err) {
    console.error('[IoT hub Client] Connect error: ' + err.message);
    return;
  }

  // set C2D and device method callback
  client.onDeviceMethod('start', onStart);
  client.onDeviceMethod('stop', onStop);
  client.on('message', receiveMessageCallback);
  setInterval(sendMessage, 2000);
});