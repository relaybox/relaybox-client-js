![npm version](https://img.shields.io/npm/v/@relaybox/client)

# RelayBox Client Library SDK

Find the full technical [documention here](https://relaybox.net/docs/api-reference/relaybox-client)

Welcome to RelayBox.

In order to use this library, you need to create a free account and [API key](https://relaybox.net/docs/authentication/api-keys). Find more details [here](https://relaybox.net/docs/getting-started).

If you find any issues, please report them [here](https://github.com/relaybox/relaybox-client-js/issues) or contact support@relaybox.net.

## Install the Client SDK Library

In order to connect to RelayBox you first need to install the client library SDK. The library is made available via the NPM registry.

```
npm install @relaybox/client
```

## Connecting an Application

Once the installation is complete, you'll be able to access the service by initializing a new RelayBox instance.

```typescript
import { RelayBox } from '@relaybox/client';

const relayBox = new RelayBox({
  apiKey: xxxx.xxxx.xxxxxxxx // Replace with your api key
});

await relayBox.connect();
```

## Create and Join a Room

Rooms are logical groups of connections that enable communication via events. To create a room, call the join() method passing the name of the room as an argument.

```typescript
const myFirstRoom = await relayBox.join('myFirstRoom');
```

If the room does not already exist, joining will create it.

## Subscribing to Events

Events are data packets transmitted to other connections listening for them (subscribers). To subscribe to an event, provide an event name and a handler function to process data as it arrives.

```typescript
await myFirstRoom.subscribe('message', (data) => {
  console.log(data);
});
```

Above, a subscription to the "message" event has been registered with a corresponsing callback function to handle the data. In our case, we will simply log the data in the console.

## Publishing an Event

To publish an event, call the publish() method, providing an event name and the data to transmit. Since we're already subscribed, let's publish a "message" event...

```typescript
const response = await myFirstRoom.publish('message', { hello: 'universe' });
```

## Putting It All Together

Putting that all together, we can see the overall structure of the code.

```typescript
import { RelayBox } from '@relaybox/client';

const relayBox = new RelayBox({
  apiKey: xxxx.xxxx.xxxxxxxx // Replace with your api key
});

await relayBox.connect();

const myFirstRoom = await relayBox.join('myFirstRoom');

await myFirstRoom.subscribe('message', (data) => {
  console.log(data);
});

const response = await myFirstRoom.publish('message', { hello: 'universe' });
```

Here, we've established a connection and joined a room. We've subscribed to an event and published an event. All connections in the room subscribed to either this specific event or to all room events will receive this data in real-time.

> Note: Always be cautious, never expose production [API keys](https://relaybox.net/docs/authentication/api-keys)!

This guide uses an API key directly in the client-side code. While this approach is possible and the quickest way to connect, it should be used with caution. The recommended, secure approach is to generate [auth tokens](https://relaybox.net/docs/authentication/auth-tokens) using a designated endpoint.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
