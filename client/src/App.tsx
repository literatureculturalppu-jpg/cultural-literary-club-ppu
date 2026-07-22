import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import { Suspense, lazy, useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { OnboardingGuard } from "./components/OnboardingGuard";
import Navigation from "./components/Navigation";
import Footer from "./components/Footer";
import BasirWidget from "./components/BasirWidget";
import Home from "./pages/Home";

// Lazy-loaded (code-split) route components — every page besides the
// homepage is only fetched by the browser once the user actually
// navigates to it, instead of all being bundled into the initial load.
const About = lazy(() => import("./pages/About"));
const Activities = lazy(() => import("./pages/Activities"));
const Articles = lazy(() => import("./pages/Articles"));
const Achievements = lazy(() => import("./pages/Achievements"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const PendingApproval = lazy(() => import("./pages/PendingApproval"));
const AdminActivities = lazy(() => import("./pages/AdminActivities"));
const AdminArticles = lazy(() => import("./pages/AdminArticles"));
const AdminMembers = lazy(() => import("./pages/AdminMembers"));
const AddActivity = lazy(() => import("./pages/AddActivity"));
const EditActivity = lazy(() => import("./pages/EditActivity"));
const AddArticle = lazy(() => import("./pages/AddArticle"));
const AddAchievement = lazy(() => import("./pages/AddAchievement"));
const EditAchievement = lazy(() => import("./pages/EditAchievement"));
const AddMember = lazy(() => import("./pages/AddMember"));
const AddTeamMember = lazy(() => import("./pages/AddTeamMember"));
const Profile = lazy(() => import("./pages/Profile"));
const AdminExternalLinks = lazy(() => import("./pages/AdminExternalLinks"));
const ActivityDetail = lazy(() => import("./pages/ActivityDetail"));
const ArticleDetail = lazy(() => import("./pages/ArticleDetail"));
const AchievementDetail = lazy(() => import("./pages/AchievementDetail"));
const Books = lazy(() => import("./pages/Books"));
const MyTeam = lazy(() => import("./pages/MyTeam"));
const TeamMembers = lazy(() => import("./pages/TeamMembers"));
const AdminTeams = lazy(() => import("./pages/AdminTeams"));
const Teams = lazy(() => import("./pages/Teams"));
const TeamDetail = lazy(() => import("./pages/TeamDetail"));
const TeamInviteAccept = lazy(() => import("./pages/TeamInviteAccept"));
const AdminRegistrationRequests = lazy(() => import("./pages/AdminRegistrationRequests"));
const AdminProfileEditRequests = lazy(() => import("./pages/AdminProfileEditRequests"));
const AdminWorkLogs = lazy(() => import("./pages/AdminWorkLogs"));
const OnboardingForm = lazy(() =>
  import("./pages/OnboardingForm").then((m) => ({ default: m.OnboardingForm }))
);
const RegistrationSettings = lazy(() => import("./pages/RegistrationSettings"));
const Login = lazy(() => import("./pages/Login"));
const BasirChat = lazy(() => import("./pages/BasirChat"));
const AdminBasirSettings = lazy(() => import("./pages/AdminBasirSettings"));
const QuickLinks = lazy(() => import("./pages/QuickLinks"));
const AdminWorkTeams = lazy(() => import("./pages/AdminWorkTeams"));
const AdminWorkTeamMembers = lazy(() => import("./pages/AdminWorkTeamMembers"));
const WorkTeamDetail = lazy(() => import("./pages/WorkTeamDetail"));
const AdminActivityRegistrations = lazy(() => import("./pages/AdminActivityRegistrations"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfUse = lazy(() => import("./pages/TermsOfUse"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location]);
  return null;
}

/** Lightweight full-width spinner shown while a lazy route chunk loads. */
function RouteFallback() {
  return (
    <div className="flex items-center justify-center py-24" dir="rtl">
      <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/about"} component={About} />
        <Route path={"/activities"} component={Activities} />
        <Route path={"/articles"} component={Articles} />
        <Route path={"/achievements"} component={Achievements} />
        <Route path={"/admin"} component={AdminDashboard} />
        <Route path={"/admin/activities"} component={AdminActivities} />
        <Route path={"/admin/articles"} component={AdminArticles} />
        <Route path={"/admin/members"} component={AdminMembers} />
        <Route path={"/admin/activities/create"} component={AddActivity} />
        <Route path={"/admin/add-activity"} component={AddActivity} />
        <Route path={"/admin/activities/:id/edit"} component={EditActivity} />
        <Route path={"/admin/add-article"} component={AddArticle} />
        <Route path={"/admin/add-achievement"} component={AddAchievement} />
        <Route path={"/admin/achievements/:id/edit"} component={EditAchievement} />
        <Route path={"/admin/add-member"} component={AddMember} />
        <Route path={"/admin/add-team-member"} component={AddTeamMember} />
        <Route path={"/admin/external-links"} component={AdminExternalLinks} />
        <Route path={"/admin/my-team"} component={MyTeam} />
        <Route path={"/admin/team/:id"} component={TeamMembers} />
        <Route path={"/admin/teams"} component={AdminTeams} />
        <Route path={"/teams"} component={Teams} />
        <Route path={"/teams/invite/:token"} component={TeamInviteAccept} />
        <Route path={"/teams/:id"} component={TeamDetail} />
        <Route path={"/admin/registration-requests"} component={AdminRegistrationRequests} />
        <Route path={"/admin/profile-edit-requests"} component={AdminProfileEditRequests} />
        <Route path={"/admin/work-logs"} component={AdminWorkLogs} />
        <Route path={"/admin/registration-settings"} component={RegistrationSettings} />
        <Route path={"/admin/activities/:id/registrations"} component={AdminActivityRegistrations} />
        <Route path={"/admin/basir-settings"} component={AdminBasirSettings} />
        <Route path={"/admin/work-teams"} component={AdminWorkTeams} />
        <Route path={"/admin/work-teams/:teamId/members"} component={AdminWorkTeamMembers} />
        <Route path={"/pending-approval"} component={PendingApproval} />
        <Route path={"/onboarding"} component={OnboardingForm} />
        <Route path={"/login"} component={Login} />
        <Route path={"/profile"} component={Profile} />
        <Route path={"/activities/:id"} component={ActivityDetail} />
        <Route path={"/articles/:id"} component={ArticleDetail} />
        <Route path={"/achievements/:id"} component={AchievementDetail} />
        <Route path={"/books"} component={Books} />
        <Route path={"/basir"} component={BasirChat} />
        <Route path={"/quick-links"} component={QuickLinks} />
        <Route path={"/work-teams/:id"} component={WorkTeamDetail} />
        <Route path={"/404"} component={NotFound} />
        <Route path={"/privacy-policy"} component={PrivacyPolicy} />
        <Route path={"/terms-of-use"} component={TermsOfUse} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <ScrollToTop />
          <div className="flex flex-col min-h-screen">
            <Navigation />
            <main className="flex-1">
              <OnboardingGuard>
                <Router />
              </OnboardingGuard>
            </main>
            <Footer />
            <BasirWidget />
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
