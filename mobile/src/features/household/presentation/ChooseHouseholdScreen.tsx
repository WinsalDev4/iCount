import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { ExpandableCard } from '@/shared/ui/ExpandableCard';
import { Screen } from '@/shared/ui/Screen';
import { TextField } from '@/shared/ui/TextField';
import { theme } from '@/shared/ui/theme';

import { useChooseSetupViewModel, type SetupOption } from './useChooseSetupViewModel';

/** Screen 03-A: how will you use iCount? Three expandable cards, one primary action each. */
export function ChooseHouseholdScreen() {
  const { state, select, setName, setCode, submit } = useChooseSetupViewModel();
  const router = useRouter();

  const toggle = (option: SetupOption) => select(state.selected === option ? null : option);

  const confirm = async () => {
    const outcome = await submit();
    // Personal and join end the setup by themselves (the access gate opens the app).
    if (outcome.kind === 'invite') {
      router.push({ pathname: '/invite', params: { householdId: outcome.householdId } });
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <AppText variant="displayXl">¿Cómo vas a usar iCount?</AppText>
            <AppText tone="muted">Podrás cambiarlo más adelante.</AppText>
          </View>

          <ExpandableCard
            title="Solo yo"
            description="Mis ingresos, gastos y objetivos."
            icon="home"
            expanded={state.selected === 'personal'}
            onToggle={() => toggle('personal')}
          >
            <TextField
              label="Nombre"
              value={state.personalName}
              onChangeText={(value) => setName('personal', value)}
              maxLength={60}
            />
            <Button
              label="Crear"
              onPress={() => void confirm()}
              disabled={!state.canSubmit}
              loading={state.working}
            />
          </ExpandableCard>

          <ExpandableCard
            title="Compartida"
            description="En pareja, en familia o con compañeros de piso."
            icon="users"
            expanded={state.selected === 'shared'}
            onToggle={() => toggle('shared')}
          >
            <TextField
              label="Nombre del hogar"
              value={state.sharedName}
              onChangeText={(value) => setName('shared', value)}
              placeholder="Casa Ana & Leo"
              maxLength={60}
            />
            <Button
              label="Crear e invitar"
              onPress={() => void confirm()}
              disabled={!state.canSubmit}
              loading={state.working}
            />
          </ExpandableCard>

          <ExpandableCard
            title="Tengo un código"
            description="Únete al hogar de otra persona."
            icon="send"
            expanded={state.selected === 'join'}
            onToggle={() => toggle('join')}
          >
            <TextField
              label="Código de invitación"
              value={state.code}
              onChangeText={setCode}
              placeholder="ABCD-2345"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
            />
            <Button
              label="Unirme"
              onPress={() => void confirm()}
              disabled={!state.canSubmit}
              loading={state.working}
            />
          </ExpandableCard>

          {state.error ? (
            <AppText tone="expense" accessibilityRole="alert">
              {state.error}
            </AppText>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: theme.spacing(6), gap: theme.spacing(4) },
  hero: { gap: theme.spacing(2), marginBottom: theme.spacing(2) },
});
