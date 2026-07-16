import { useEffect, useState } from "react";
import styled from "styled-components";
import { HiOutlineUser } from "react-icons/hi2";
import { resolveAvatarDisplay } from "./avatarIdentity";

const AvatarShell = styled.div<{ $size: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${(props) => props.$size};
  height: ${(props) => props.$size};
  border-radius: 50%;
  flex-shrink: 0;
  overflow: hidden;
`;

const AvatarImage = styled.img`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
`;

const AvatarInitials = styled(AvatarShell)`
  background-color: var(--color-brand-100);
  color: var(--color-brand-700);
  font-size: 1.2rem;
  font-weight: 700;
`;

const AvatarIcon = styled(AvatarShell)`
  background-color: var(--color-grey-100);
  color: var(--color-grey-500);

  & svg {
    width: 60%;
    height: 60%;
  }
`;

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: string;
  // True when the surrounding control (e.g. the account popover trigger)
  // already carries the full accessible name -- the avatar is then purely
  // decorative and must not compete with it.
  decorative?: boolean;
}

function Avatar({ src = null, name, size = "3.6rem", decorative = false }: AvatarProps) {
  const [hasImageError, setHasImageError] = useState(false);

  // Reset the error flag whenever the source changes so a previously
  // broken image does not permanently block a later, valid one.
  useEffect(() => {
    setHasImageError(false);
  }, [src]);

  const { mode, initials } = resolveAvatarDisplay({ src, hasImageError, name });
  const a11yProps = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": name || "Usuario" };

  if (mode === "image" && src) {
    return (
      <AvatarShell $size={size} {...a11yProps}>
        <AvatarImage
          src={src}
          alt={decorative ? "" : name}
          onError={() => setHasImageError(true)}
        />
      </AvatarShell>
    );
  }

  if (mode === "initials") {
    return (
      <AvatarInitials $size={size} {...a11yProps}>
        {initials}
      </AvatarInitials>
    );
  }

  return (
    <AvatarIcon $size={size} {...a11yProps}>
      <HiOutlineUser />
    </AvatarIcon>
  );
}

export default Avatar;
