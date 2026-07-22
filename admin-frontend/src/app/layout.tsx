import './globals.css';

export const metadata = { title: 'Limiance Admin', description: 'Limiance operations console' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
