import { AppShell, Burger, Container, Group, Stack, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import Settings from "./pages/Settings";
import Skills from "./pages/Skills";
import Agents from "./pages/Agents";

const navItems = [
  { to: "/", label: "Settings" },
  { to: "/skills", label: "Skills" },
  { to: "/agents", label: "Agents" },
];

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          onClick={onNavigate}
          style={({ isActive }) => ({
            textDecoration: "none",
            fontWeight: isActive ? 600 : 400,
            color: isActive
              ? "var(--mantine-color-blue-filled)"
              : "var(--mantine-color-text)",
            padding: "8px 12px",
            borderRadius: "var(--mantine-radius-md)",
            background: isActive
              ? "var(--mantine-color-blue-light)"
              : "transparent",
          })}
        >
          {item.label}
        </NavLink>
      ))}
    </>
  );
}

export default function App() {
  const [opened, { toggle, close }] = useDisclosure();

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{
        width: 200,
        breakpoint: "sm",
        collapsed: { desktop: true, mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={3} size="h4">
              ide-agents
            </Title>
          </Group>
          <Group gap="xs" visibleFrom="sm">
            <NavItems />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md" hiddenFrom="sm">
        <Stack gap="xs">
          <NavItems onNavigate={close} />
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Container size="lg" py="sm" px={{ base: "xs", sm: "md" }}>
          <Routes>
            <Route path="/" element={<Settings />} />
            <Route path="/skills" element={<Skills />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/artifacts" element={<Navigate to="/skills" replace />} />
          </Routes>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
