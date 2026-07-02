import { HelpDeskShell } from "@/components/help-desk/HelpDeskShell";

export const metadata = {
  title: "Infinity Remote Help Desk",
  description: "Centro de soporte remoto N1 para ISP",
};

export default function HelpDeskLayout({ children }: { children: React.ReactNode }) {
  return <HelpDeskShell>{children}</HelpDeskShell>;
}
