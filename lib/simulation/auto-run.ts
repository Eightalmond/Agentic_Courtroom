export async function runSequentially<T>(
  initial: T,
  options: {
    isActive(): boolean;
    canContinue(value: T): boolean;
    takeStep(value: T): Promise<T | undefined>;
  },
) {
  let current: T | undefined = initial;

  while (current && options.isActive() && options.canContinue(current)) {
    current = await options.takeStep(current);
  }

  return current;
}
