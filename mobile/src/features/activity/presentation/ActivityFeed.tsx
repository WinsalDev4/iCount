import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui/AppText';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { GlassCard } from '@/shared/ui/GlassCard';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { TextField } from '@/shared/ui/TextField';
import { theme } from '@/shared/ui/theme';

import { type ActivityRow, useActivityViewModel } from './useActivityViewModel';

/** Activity feed of the household (screen 09-C), with approvals and comments. */
export function ActivityFeed() {
  const vm = useActivityViewModel();
  const router = useRouter();
  const { state } = vm;

  if (state.status === 'loading') {
    return (
      <ActivityIndicator color={theme.colors.accent} accessibilityLabel="Cargando actividad" />
    );
  }
  if (state.status === 'error') {
    return (
      <GlassCard style={styles.gap}>
        <AppText tone="muted" accessibilityRole="alert">
          {state.message}
        </AppText>
        <Button label="Reintentar" variant="secondary" onPress={() => void vm.refresh()} />
      </GlassCard>
    );
  }

  const renderRow = (row: ActivityRow) => {
    const rejecting =
      row.canDecide && state.rejecting?.transactionId === row.transactionId
        ? state.rejecting
        : null;
    const comments =
      row.canComment && state.comments?.transactionId === row.transactionId ? state.comments : null;
    const busy = state.busyId === row.transactionId;
    return (
      <GlassCard key={row.id} style={styles.gap}>
        <Pressable
          accessibilityRole={row.transactionId ? 'button' : undefined}
          accessibilityLabel={`${row.text}${row.amount ? `, ${row.amount}` : ''}, ${row.when}`}
          disabled={!row.transactionId}
          onPress={() =>
            row.transactionId &&
            router.push({ pathname: '/transaction/[id]', params: { id: row.transactionId } })
          }
          style={styles.row}
        >
          <Avatar name={row.actor} size={36} />
          <View style={styles.texts}>
            <AppText>{row.text}</AppText>
            <AppText variant="small" tone="muted">
              {row.when}
              {row.approval ? ` · ${row.approval.label}` : ''}
            </AppText>
          </View>
          {row.amount ? <AppText style={styles.strong}>{row.amount}</AppText> : null}
        </Pressable>

        {row.canDecide && row.transactionId && !rejecting ? (
          <View style={styles.actions}>
            <Button
              label="Aprobar"
              loading={busy}
              onPress={() => void vm.approve(row.transactionId as string)}
            />
            <Button
              label="Rechazar"
              variant="secondary"
              disabled={busy}
              onPress={() => vm.startReject(row.transactionId as string)}
            />
          </View>
        ) : null}

        {rejecting ? (
          <View style={styles.gap}>
            <TextField
              label="Motivo del rechazo"
              value={rejecting.reason}
              onChangeText={vm.changeReason}
              placeholder="Cuéntale por qué"
              maxLength={140}
            />
            <Button
              label="Confirmar rechazo"
              variant="danger"
              disabled={!rejecting.canConfirm}
              loading={busy}
              onPress={() => void vm.confirmReject()}
            />
            <Button label="Cancelar" variant="ghost" onPress={vm.cancelReject} />
          </View>
        ) : null}

        {row.canComment && row.transactionId ? (
          <Chip
            label={row.commentCount > 0 ? `Comentarios (${row.commentCount})` : 'Comentar'}
            selected={comments !== null}
            onPress={() => vm.toggleComments(row.transactionId as string)}
          />
        ) : null}

        {comments ? (
          <View style={styles.gap}>
            {comments.loading ? (
              <ActivityIndicator
                color={theme.colors.accent}
                accessibilityLabel="Cargando comentarios"
              />
            ) : null}
            {comments.items.map((c) => (
              <View key={c.id}>
                <AppText variant="small" style={styles.strong}>
                  {c.author} · {c.when}
                </AppText>
                <AppText>{c.body}</AppText>
              </View>
            ))}
            <TextField
              label="Escribe un comentario"
              value={comments.draft}
              onChangeText={vm.changeDraft}
              maxLength={500}
            />
            <Button
              label="Enviar comentario"
              disabled={!comments.canSend}
              onPress={() => void vm.sendComment()}
            />
          </View>
        ) : null}
      </GlassCard>
    );
  };

  return (
    <View style={styles.gap}>
      <SegmentedControl
        accessibilityLabel="Filtro de actividad"
        value={state.filter}
        onChange={vm.selectFilter}
        options={[
          { value: 'all', label: 'Todo' },
          {
            value: 'to-review',
            label: state.toReviewCount > 0 ? `Por revisar (${state.toReviewCount})` : 'Por revisar',
          },
        ]}
      />
      {state.error ? (
        <AppText tone="expense" accessibilityRole="alert">
          {state.error}
        </AppText>
      ) : null}
      {state.rows.length === 0 ? (
        <AppText tone="muted">
          {state.filter === 'to-review'
            ? 'No tienes nada por revisar. ¡Todo al día!'
            : 'Aún no hay actividad en el hogar.'}
        </AppText>
      ) : (
        state.rows.map(renderRow)
      )}
      {state.hasMore ? (
        <Button
          label="Ver más"
          variant="secondary"
          loading={state.loadingMore}
          onPress={() => void vm.loadMore()}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: theme.spacing(3) },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3) },
  texts: { flex: 1 },
  actions: { gap: theme.spacing(2) },
  strong: { fontFamily: theme.fonts.semibold },
});
