import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.06), 0 6px 20px rgba(0,0,0,0.05)';

export interface ReinforcementModuleCardDef {
  id: string;
  icon: React.ReactNode;
  title: string;
  count: number;
  loading: boolean;
  color: string;
  iconBg: string;
  activeBg: string;
  activeBorder: string;
  activeShadow: string;
}

interface BaseProps extends ReinforcementModuleCardDef {
  isActive?: boolean;
  hoverActive?: boolean;
}

interface ButtonCard extends BaseProps {
  onClick: () => void;
  to?: never;
}

interface LinkCard extends BaseProps {
  to: string;
  onClick?: never;
}

type ReinforcementModuleCardProps = ButtonCard | LinkCard;

const CardInner: React.FC<{ mod: BaseProps & { isActive: boolean } }> = ({ mod }) => {
  const { isActive, icon, title, count, loading, color, iconBg } = mod;
  return (
    <>
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors duration-200 ${isActive ? iconBg : 'bg-zinc-100'}`}>
          <span className={`${color} transition-opacity duration-200 ${isActive ? '' : 'opacity-60'}`}>{icon}</span>
        </div>
        {loading
          ? <Loader2 size={14} className="animate-spin text-text-muted" />
          : <span className={`text-3xl font-bold leading-none tabular-nums transition-colors duration-200 ${isActive ? color : 'text-text-main'}`}>{count}</span>
        }
      </div>
      <p className={`text-sm font-semibold leading-tight transition-colors duration-200 ${isActive ? 'text-text-main' : 'text-text-muted'}`}>
        {title}
      </p>
    </>
  );
};

const sharedClass = (isActive: boolean, mod: BaseProps) =>
  [
    'flex flex-col gap-3 rounded-2xl border p-5 text-left transition-all duration-200',
    'hover:-translate-y-px focus:outline-none',
    isActive
      ? `${mod.activeBg} ${mod.activeBorder}`
      : 'bg-white border-black/[0.06]',
  ].join(' ');

export const ReinforcementModuleCard: React.FC<ReinforcementModuleCardProps> = (props) => {
  const [hovered, setHovered] = useState(false);
  const isActive = (props.isActive ?? false) || (props.hoverActive === true && hovered);
  const shadow = isActive ? props.activeShadow : CARD_SHADOW;

  const hoverHandlers = props.hoverActive
    ? { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) }
    : {};

  if (props.to !== undefined) {
    return (
      <Link
        to={props.to}
        className={sharedClass(isActive, props)}
        style={{ boxShadow: shadow }}
        {...hoverHandlers}
      >
        <CardInner mod={{ ...props, isActive }} />
      </Link>
    );
  }

  return (
    <button
      onClick={props.onClick}
      className={sharedClass(isActive, props)}
      style={{ boxShadow: shadow }}
      {...hoverHandlers}
    >
      <CardInner mod={{ ...props, isActive }} />
    </button>
  );
};
