import { Stack } from 'expo-router';

/** Opening the group must land on the first step, whatever order the files are sorted in. */
export const unstable_settings = { initialRouteName: 'choose' };

export default function SetupLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
