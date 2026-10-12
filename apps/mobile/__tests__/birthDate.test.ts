import { toBirthDate } from '../src/features/consents/birthDate';

test('a real date becomes YYYY-MM-DD', () => {
  expect(toBirthDate('21', '3', '1998')).toBe('1998-03-21');
  expect(toBirthDate('29', '02', '2000')).toBe('2000-02-29');
});

test('a day that does not exist, or a short year, is rejected', () => {
  expect(toBirthDate('31', '2', '2000')).toBeNull();
  expect(toBirthDate('29', '2', '1999')).toBeNull();
  expect(toBirthDate('1', '13', '1999')).toBeNull();
  expect(toBirthDate('1', '1', '99')).toBeNull();
  expect(toBirthDate('', '1', '1999')).toBeNull();
});
