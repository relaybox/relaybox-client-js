# RelayBox Client Library SDK

Welcome to RelayBox.

A free account is required in order to use this library. Please find more details [here](https://relaybox.net/docs/getting-started#creating-your-first-application).

## Install the Client SDK Library

To begin using Relaybox, we first need to install the library from Node Package Manager (NPM).

```typescript
npm install @relaybox/client
```

## Connecting an Application

Once the installation is complete, you'll be able to access the service by initializing a new Relaybox instance.

```typescript
import { RelayBox } from '@relaybox/client';

const relayBox = new RelayBox({
  apiKey: xxxx.xxxx.xxxxxxxx // Replace with your api key
});

await relayBox.connect();
```

## Create and Join a Room

So far, we've set up an account, created an API key, and established a connection between your client and the Relaybox service. Now let's create and join our first room.

Rooms are logical groups of connections that enable communication via events...

```typescript
const myFirstRoom = await relayBox.join('myFirstRoom');
```

If the room has not already been created, joining will create it.

## Subscribing to Events

Now that we've established a connection and joined a room, let's subscribe to an event. Events are data packets that are transmitted to other connections listening for them (subscribers). To subscribe to an event, we need to provide the event name we're interested in and a handler to process data as it arrives.

Let's subscribe to the "message" event...

```typescript
await myFirstRoom.subscribe('message', (data) => {
  console.log(data);
});
```

In the code above, we subscribed to the "message" event and provided a callback function to handle the data. In our case, we will simply log the data in the console.

## Publishing an Event

Ok, the final piece of the puzzle! It's time to publish an event. We'll need to provide an event name and some data to transmit. Since we're already subscribed, let's publish a "message" event...

```typescript
const response = await myFirstRoom.publish('message', { name: 'Bob' });
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

const response = await myFirstRoom.publish('message', { name: 'Bob' });
```
