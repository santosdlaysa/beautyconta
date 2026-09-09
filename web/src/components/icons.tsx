import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const Base = ({ children, ...props }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {children}
  </svg>
);

export const SparkleIcon = (props: IconProps) => <Base {...props}><path d="M12 3c.7 4.7 2.3 6.3 7 7-4.7.7-6.3 2.3-7 7-.7-4.7-2.3-6.3-7-7 4.7-.7 6.3-2.3 7-7Z"/><path d="M19 16c.25 1.75.9 2.4 2.5 2.75-1.6.35-2.25 1-2.5 2.75-.25-1.75-.9-2.4-2.5-2.75 1.6-.35 2.25-1 2.5-2.75Z"/></Base>;
export const CalculatorIcon = (props: IconProps) => <Base {...props}><rect x="5" y="2.5" width="14" height="19" rx="2.5"/><path d="M8 6h8v3H8zM8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01"/></Base>;
export const ChartIcon = (props: IconProps) => <Base {...props}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></Base>;
export const CheckIcon = (props: IconProps) => <Base {...props}><path d="m5 12 4 4L19 6"/></Base>;
export const ArrowIcon = (props: IconProps) => <Base {...props}><path d="M5 12h14M14 7l5 5-5 5"/></Base>;
export const MenuIcon = (props: IconProps) => <Base {...props}><path d="M4 7h16M4 12h16M4 17h16"/></Base>;
export const ClockIcon = (props: IconProps) => <Base {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Base>;
export const ShieldIcon = (props: IconProps) => <Base {...props}><path d="M12 3 4.5 6v5c0 4.8 3 8.4 7.5 10 4.5-1.6 7.5-5.2 7.5-10V6L12 3Z"/><path d="m9 12 2 2 4-4"/></Base>;
export const AlertIcon = (props: IconProps) => <Base {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5M12 16.2h.01"/></Base>;
export const SpinnerIcon = (props: IconProps) => <Base {...props}><path d="M12 3a9 9 0 1 0 9 9" /></Base>;
export const HelpIcon = (props: IconProps) => <Base {...props}><circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2-2.4 3.4M12 17.2h.01"/></Base>;
export const CoinIcon = (props: IconProps) => <Base {...props}><ellipse cx="12" cy="6.5" rx="7.5" ry="3.5"/><path d="M4.5 6.5v11c0 1.9 3.4 3.5 7.5 3.5s7.5-1.6 7.5-3.5v-11M4.5 12c0 1.9 3.4 3.5 7.5 3.5s7.5-1.6 7.5-3.5"/></Base>;
