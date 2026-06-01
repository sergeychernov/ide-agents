import clsx from 'clsx';
import GitHubRepoBadge from '@site/src/components/GitHubRepoBadge';

type Props = {
  className?: string;
  mobile?: boolean;
};

export default function GitHubRepoBadgeNavbarItem({
  className,
  mobile,
}: Props) {
  return (
    <div
      className={clsx(
        !mobile && 'navbar__item',
        mobile && 'menu__list-item',
        className,
      )}>
      <GitHubRepoBadge />
    </div>
  );
}
