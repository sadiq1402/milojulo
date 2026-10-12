// Reads the sign-in code from the local stack's mail catcher.
export async function latestCodeFor(email: string): Promise<string> {
  const base = process.env.MAILPIT_URL;
  for (let attempt = 0; attempt < 20; attempt++) {
    const search = await fetch(
      `${base}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    );
    const { messages } = (await search.json()) as {
      messages: { ID: string }[];
    };
    if (messages.length > 0) {
      const message = await fetch(`${base}/api/v1/message/${messages[0].ID}`);
      const { Text } = (await message.json()) as { Text: string };
      const code = Text.match(/\b\d{6}\b/)?.[0];
      if (code) {
        return code;
      }
    }
    await new Promise<void>(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`no code emailed to ${email}`);
}
