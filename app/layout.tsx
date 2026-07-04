import "./globals.css";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import UtilityHeader from "@/components/layout/UtilityHeader";

export const metadata = {
  title: "SignalAtlas",
  description: "Ranked research signals from XR and marine robotics labs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <UtilityHeader />
        {children}
      </body>
    </html>
  );
}
