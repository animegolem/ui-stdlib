declare const Button: (props: Record<string, unknown>) => unknown;

export const valid = <Button variant="quiet" />;
export const invalid = <Button class="quiet" />;
