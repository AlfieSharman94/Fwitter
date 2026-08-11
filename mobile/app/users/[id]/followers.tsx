import { useLocalSearchParams } from "expo-router";
import { UserConnectionsList } from "../../../src/components/UserConnectionsList";

export default function FollowersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <UserConnectionsList userId={String(id)} type="followers" />;
}
