import { useIntl } from '@cookbook/solid-intl';
import { useLocation, useNavigate } from '@solidjs/router';
import { Component, For, Match, Show, Switch } from 'solid-js';
import { useAccountContext } from '../../contexts/AccountContext';
import { useNotificationsContext } from '../../contexts/NotificationsContext';
import { navBar as t, actions as tActions, placeholders as tPlaceholders } from '../../translations';
import NavLink from '../NavLink/NavLink';
import styles from './NavMenu.module.scss';
import { hookForDev } from '../../lib/devTools';
import ButtonPrimary from '../Buttons/ButtonPrimary';
import { useMediaContext } from '../../contexts/MediaContext';
import { ConfirmInfo, useAppContext } from '../../contexts/AppContext';
import { useDMContext } from '../../contexts/DMContext';
import ButtonSecondary from '../Buttons/ButtonSecondary';

const NavMenu: Component< { id?: string } > = (props) => {
  const account = useAccountContext();
  const notifications = useNotificationsContext();
  const dms = useDMContext();
  const intl = useIntl();
  const loc = useLocation();
  const media = useMediaContext();
  const app = useAppContext();
  const navigate = useNavigate();

  const links = [
    {
      to: '/',
      label: intl.formatMessage(t.home),
      icon: 'homeIcon',
    },
    {
      to: '/reads',
      label: intl.formatMessage(t.reads),
      icon: 'readsIcon',
    },
    {
      to: '/notifications',
      label: intl.formatMessage(t.notifications),
      icon: 'notificationsIcon',
      badge: notifications?.notificationCount,
    },
    {
      to: '/messages',
      label: intl.formatMessage(t.messages),
      icon: 'messagesIcon',
      badge: dms?.dmsCount,
    },
  ];

  const isActive = (link: { to: string, label: string, icon: string }) => {
    if (link.to === '/') {
      return loc.pathname === '/';
    }

    return loc.pathname.startsWith(link.to);
  };

  const doNewPost = () => {
    app?.actions.openNewNoteModal();
  };

  // @ts-ignore
  hookForDev(() => {
    return {
      dms,
    };
  });

  return (
    <div id={props.id} class={styles.navMenu}>
      <Show
        when={!media?.actions.isSmallDevice()}
        fallback={
          <button
            onClick={doNewPost}
            class={styles.smallButton}
          >
            <div class="gg-add"></div>
          </button>
        }
      >
        <ButtonPrimary
          onClick={doNewPost}
          class={styles.newNoteButton}
        >
          {intl.formatMessage(tActions.newNote)}
        </ButtonPrimary>
      </Show>
      <For each={links}>
        {(link) => (
          <NavLink
            to={link.to}
            label={link.label}
            icon={link.icon}
            isActive={isActive(link)}
            badge={link.badge}
          />
        )}
      </For>
    </div>
  );
};

export default NavMenu;
