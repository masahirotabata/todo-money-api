package com.example.todomoney.web;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

import com.example.todomoney.security.AppPrincipal;

import jakarta.servlet.http.HttpServletRequest;

public class AuthUtil {
    public static Long requireUserId(HttpServletRequest req) {
        Object v = req.getAttribute("userId");

        if (v instanceof Long) return (Long) v;
        if (v instanceof Integer) return ((Integer) v).longValue();

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (auth != null && auth.getPrincipal() instanceof AppPrincipal principal) {
            return principal.userId();
        }

        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized");
    }
}