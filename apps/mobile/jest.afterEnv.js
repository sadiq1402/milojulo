const { configure } = require('@testing-library/react-native');
const storage = require('./test/memoryStorage').default;

// Tests render the whole app; on CI's 2-CPU runners a screen can take over the default 1 s to appear (#154).
configure({ asyncUtilTimeout: 5000 });

// Each test starts with nothing kept on the phone.
afterEach(() => storage.clear());
