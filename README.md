# RelayBox Client Library SDK

Find the full technical [documention here](https://relaybox.net/docs)

Welcome to RelayBox.

In order to use this library, you need to create a free account and [API key](https://relaybox.net/docs/authentication/api-keys). Find more details [here](https://relaybox.net/docs/getting-started).

## Install the Client SDK Library

To get started, install the client library SDK from NPM

```
npm install @relaybox/client
```

## Connecting an Application

Once the installation is complete, you'll be able to access realtime services by initializing a new RelayBox instance.

```typescript
import { RelayBox } from '@relaybox/client';

const relayBox = new RelayBox({
  apiKey: xxxx.xxxx.xxxxxxxx // Replace with your api key
});

await relayBox.connect();
```

## Create and Join a Room

So far, we've set up an account, created an [API key](https://relaybox.net/docs/authentication/api-keys), and established a connection from your client-side application. Now let's create and join our first room.

Rooms are logical groups of connections that enable communication via events...

```typescript
const myFirstRoom = await relayBox.join('myFirstRoom');
```

If the room has not already been created, joining will create it.

## Subscribing to Events

Events are data packets transmitted to other connections listening for them (subscribers). To subscribe to an event, provide the event name and a handler to process data as it arrives.

```typescript
await myFirstRoom.subscribe('message', (data) => {
  console.log(data);
});
```

In the lines above, we subscribed to the "message" event and provided a callback function to handle the data. In our case, we will simply log the data in the console.

## Publishing an Event

To publish an event, provide an event name and data to transmit. Since we're already subscribed, let's publish a "message" event...

```typescript
const response = await myFirstRoom.publish('message', { hello: 'universe' });
```

## Putting It All Together

Let's put all that together so that we can see the overall structure of the code.

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