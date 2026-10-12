const storage = require('./test/memoryStorage').default;

// Each test starts with nothing kept on the phone.
afterEach(() => storage.clear());
