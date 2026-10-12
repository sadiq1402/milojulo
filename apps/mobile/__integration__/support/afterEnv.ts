import { deleteTestAccounts } from './cleanup';

afterAll(() => deleteTestAccounts());
