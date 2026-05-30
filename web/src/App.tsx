import { useCallback, useEffect, useState } from "react";
import { AppShell, Burger, Container, Group, Stack, Text, Title, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { api } from "./api/client";
import Settings from "./pages/Settings";
import Repositories from "./pages/Repositories";
import Skills from "./pages/Skills";
import Agents from "./pages/Agents";

interface NavCatalog {
  skills: boolean;
  agents: boolean;
}

function NavItems({
  catalog,
  onNavigate,
}: {
  catalog: NavCatalog;
  onNavigate?: () => void;
}) {
  const items = [
    { to: "/settings", label: "Settings", enabled: true },
    { to: "/repositories", label: "Repositories", enabled: true },
    {
      to: "/skills",
      label: "Skills",
      enabled: catalog.skills,
      disabledHint: "Add a repository that contains skills",
    },
    {
      to: "/agents",
      label: "Agents",
      enabled: catalog.agents,
      disabledHint: "Add a repository that contains agents",
    },
  ];

  return (
    <>
      {items.map((item) => {
        if (!item.enabled) {
          return (
            <Tooltip key={item.to} label={item.disabledHint}>
              <Text
                size="sm"
                c="dimmed"
                px={12}
                py={8}
                style={{ cursor: "not-allowed", opacity: 0.55 }}
              >
                {item.label}
              </Text>
            </Tooltip>
          );
        }

        return (
          <NavLink
            key={item.to}
            to={item.to}
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
        );
      })}
    </>
  );
}

export default function App() {
  const [opened, { toggle, close }] = useDisclosure();
  const location = useLocation();
  const [catalog, setCatalog] = useState<NavCatalog>({
    skills: false,
    agents: false,
  });

  const refreshCatalog = useCallback(async () => {
    const { repos } = await api.repos();
    setCatalog({
      skills: repos.some((r) => r.skillCount > 0),
      agents: repos.some((r) => r.agentCount > 0),
    });
  }, []);

  useEffect(() => {
    refreshCatalog().catch(() => {
      setCatalog({ skills: false, agents: false });
    });
  }, [refreshCatalog, location.pathname]);

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
            <NavItems catalog={catalog} />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md" hiddenFrom="sm">
        <Stack gap="xs">
          <NavItems catalog={catalog} onNavigate={close} />
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Container size="lg" py="sm" px={{ base: "xs", sm: "md" }}>
          <Routes>
            <Route path="/" element={<Navigate to="/repositories" replace />} />
            <Route path="/settings" element={<Settings />} />
            <Route
              path="/repositories"
              element={<Repositories onReposChange={refreshCatalog} />}
            />
            <Route
              path="/skills"
              element={
                catalog.skills ? (
                  <Skills />
                ) : (
                  <Navigate to="/repositories" replace />
                )
              }
            />
            <Route
              path="/agents"
              element={
                catalog.agents ? (
                  <Agents />
                ) : (
                  <Navigate to="/repositories" replace />
                )
              }
            />
            <Route path="/artifacts" element={<Navigate to="/skills" replace />} />
          </Routes>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
