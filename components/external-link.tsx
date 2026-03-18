import { Link } from "expo-router";
import { openBrowserAsync, WebBrowserPresentationStyle } from "expo-web-browser";
import { type ComponentProps } from "react";

type Props = ComponentProps<typeof Link>;

export function ExternalLink({ href, ...rest }: Props) {
  return (
    <Link
      target="_blank"
      {...rest}
      href={href}
      onPress={async (event: any) => {
        if (process.env.EXPO_OS !== "web") {
          // Prevent the default behavior of linking to the default browser on native.
          event.preventDefault();
          // Open the link in an in-app browser.
          await openBrowserAsync(href as string, {
            presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
          });
        }
      }}
    />
  );
}
