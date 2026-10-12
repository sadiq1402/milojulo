import { admin } from './admin';

// Every account a test makes has an @test.milojulo email; deleting them after each file keeps
// the local database clean (profiles, Connections and messages go with them).
export async function deleteTestAccounts() {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    throw error;
  }
  for (const user of data.users.filter(u =>
    u.email?.endsWith('@test.milojulo'),
  )) {
    await admin.auth.admin.deleteUser(user.id);
  }
}
