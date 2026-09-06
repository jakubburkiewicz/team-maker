import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";
import { isProtectedRoute } from "@/lib/routes";

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;
  } else {
    context.locals.user = null;
  }

  if (isProtectedRoute(context.url.pathname)) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }
  }

  return next();
});
