// Cloud authentication is outside this local RAW proof; never fake a user/token.
export async function initClerk(){throw new Error('Native Clerk authentication is unavailable in this isolated browser proof');}
