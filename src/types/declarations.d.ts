// Allow side-effect and module imports of CSS files used by NativeWind / Metro.
declare module '*.css';
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
