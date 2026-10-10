declare const active: boolean;
declare const tone: () => string;
declare const buttonVariants: (value: unknown) => Record<string, boolean>;

export const validStatic = <div classList={{ selected: active }} />;
export const validVariant = <div classList={buttonVariants({ tone })} />;
export const invalid = <div classList={{ [tone()]: true }} />;
