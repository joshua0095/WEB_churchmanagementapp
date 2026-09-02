import logo from "../../assets/jil-logo-png.png";

interface LogoProps {
  /** Rendered width in pixels; height scales automatically. */
  size?: number;
  className?: string;
}

/**
 * The Jesus Is Lord Church wordmark. The source PNG is white-on-transparent,
 * so it must be placed on a dark (navy) surface to be visible.
 */
function Logo({ size = 64, className }: LogoProps) {
  return (
    <img
      src={logo}
      alt="Jesus Is Lord Church"
      className={["ui-logo", className].filter(Boolean).join(" ")}
      style={{ width: size }}
    />
  );
}

export default Logo;
