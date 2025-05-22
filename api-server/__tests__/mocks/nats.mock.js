const nats = {
  connect: jest.fn().mockReturnValue({
    subscribe: jest.fn().mockReturnValue({
      on: jest.fn(),
      unsubscribe: jest.fn()
    }),
    publish: jest.fn(),
    close: jest.fn()
  })
};

module.exports = nats; 