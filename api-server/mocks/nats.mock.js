// Mock NATS connection
const mockNATS = {
  connect: jest.fn().mockResolvedValue({
    subscribe: jest.fn(),
    publish: jest.fn(),
    close: jest.fn()
  })
};

export default mockNATS; 