import "./globals.css";
import AppProviders from "@/components/common/AppProviders";

export const metadata = {
  title: "Chatty",
  description: "Realtime chat app built with Next.js",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
