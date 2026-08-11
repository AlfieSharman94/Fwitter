import { useLocalSearchParams } from "expo-router";
import { UserConnectionsList } from "../../../src/components/UserConnectionsList";

export default function FollowingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <UserConnectionsList userId={String(id)} type="following" />;
}
