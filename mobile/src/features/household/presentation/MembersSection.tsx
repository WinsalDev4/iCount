import { Share, StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui/AppText';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { GlassCard } from '@/shared/ui/GlassCard';
import { theme } from '@/shared/ui/theme';

import { useMembersViewModel } from './useMembersViewModel';

/** Members of the household: who is in, their declared incomes, the split rule and an invite. */
export function MembersSection() {
  const { state, newInvite } = useMembersViewModel();

  return (
    <GlassCard style={styles.card}>
      <AppText variant="label" tone="muted" accessibilityRole="header">
        MIEMBROS
      </AppText>
      {state.members.map((member) => (
        <View key={member.id} style={styles.row} accessible>
          <Avatar name={member.name} size={36} />
          <View style={styles.texts}>
            <AppText>
              {member.name}
              {member.isMe ? ' (tú)' : ''}
            </AppText>
            <AppText variant="small" tone="muted">
              {member.roleLabel}
              {member.income ? ` · ${member.income}` : ''}
            </AppText>
          </View>
        </View>
      ))}
      <View accessible>
        <AppText variant="label" tone="muted">
          REPARTO DE GASTOS
        </AppText>
        <AppText>{state.splitRule}</AppText>
      </View>

      {state.invite ? (
        <View style={styles.invite}>
          <AppText
            variant="displayM"
            tone="accent"
            accessibilityLabel={`Código ${state.invite.code}`}
          >
            {state.invite.code}
          </AppText>
          <Button
            label="Compartir código"
            variant="secondary"
            onPress={() => void Share.share({ message: state.invite?.shareMessage ?? '' })}
          />
        </View>
      ) : null}
      {state.error ? (
        <AppText tone="expense" accessibilityRole="alert">
          {state.error}
        </AppText>
      ) : null}
      <Button
        label={state.invite ? 'Nuevo código' : 'Invitar a alguien'}
        variant={state.invite ? 'ghost' : 'primary'}
        loading={state.busy}
        onPress={() => void newInvite()}
      />
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: theme.spacing(3) },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3) },
  texts: { flex: 1 },
  invite: { gap: theme.spacing(2) },
});
